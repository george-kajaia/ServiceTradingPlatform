using System.Net.Mime;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using ServiceTokenApi.DBContext;
using ServiceTokenApi.Dto;
using ServiceTokenApi.Entities;
using ServiceTokenApi.Enums;
using ServiceTokenApi.Options;
using ServiceTokenApi.Services.Flitt;

namespace ServiceTokenApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces(MediaTypeNames.Application.Json)]
public class PaymentController(
    ServiceTokenDbContext db,
    IFlittPaymentService flitt,
    IOptions<FlittOptions> flittOptions,
    IOptions<GeneralOptions> generalOptions,
    ILogger<PaymentController> logger) : ControllerBase
{
    private readonly FlittOptions _options = flittOptions.Value;
    private readonly GeneralOptions _general = generalOptions.Value;

    [HttpPost("InitiateEmbeddedPaymentBatch")]
    public async Task<ActionResult<InitiatePaymentResultDto>> InitiateEmbeddedPaymentBatch([FromBody] InitiatePaymentBatchRequestDto request)
    {
        if (request?.Tokens is null || request.Tokens.Count == 0)
            return BadRequest("No tokens supplied for payment.");

        if (string.IsNullOrWhiteSpace(request.CustomerPublicKey))
            return BadRequest("Customer public key is required.");

        var refs = request.Tokens
            .Where(t => !string.IsNullOrWhiteSpace(t.ServiceTokenId))
            .GroupBy(t => t.ServiceTokenId)
            .Select(g => g.First())
            .ToList();

        if (refs.Count == 0) return BadRequest("No valid tokens supplied for payment.");

        var tokenIds = refs.Select(x => x.ServiceTokenId).ToList();

        var serviceTokens = await db.ServiceTokens
            .Where(x => tokenIds.Contains(x.Id))
            .ToListAsync();

        var lineItems = new List<(string TokenId, decimal Price)>();
        foreach (var tokenRef in refs)
        {
            var token = serviceTokens.Where(x => x.Id == tokenRef.ServiceTokenId && x.RowVersion == tokenRef.RowVersion).FirstOrDefault();
            if (token is null)
                return NotFound($"Token {tokenRef.ServiceTokenId} was changed by another user. Refresh the data.");

            if (token.Price <= 0)
                return BadRequest($"Product price is not configured for token {tokenRef.ServiceTokenId}.");

            lineItems.Add((token.Id, token.Price));
        }

        var total = lineItems.Sum(x => x.Price);
        if (total <= 0) return BadRequest("Order total must be greater than zero.");

        // One order id, shared by every per-token Payment row and sent once to Flitt.
        var orderId = Guid.NewGuid().ToString("N");
        var now = DateTime.UtcNow;

        var payments = lineItems.Select(li => new Payment
        {
            MerchantPaymentId = orderId,
            ServiceTokenId = li.TokenId,
            CustomerPublicKey = request.CustomerPublicKey,
            Amount = li.Price,
            Currency = "GEL",
            Status = PaymentStatus.Created,
            CreatedAt = now,
            UpdatedAt = now
        }).ToList();

        db.Payments.AddRange(payments);
        await db.SaveChangesAsync();

        FlittTokenResult tokenResult;
        try
        {
            var description = payments.Count == 1
                ? $"Service token {payments[0].ServiceTokenId}"
                : $"{payments.Count} service tokens";

            // The payment provider is invoked exactly once, for the summed amount. When the buyer
            // opted to save their card, ask Flitt to return a reusable card token (rectoken).
            tokenResult = await flitt.CreateOrderAsync(total, orderId, description, requiredRectoken: request.SaveCard);
        }
        catch (FlittPaymentException ex)
        {
            logger.LogError(ex, "Failed to create Flitt order {OrderId} for {Count} token(s)", orderId, payments.Count);
            var failedAt = DateTime.UtcNow;
            foreach (var p in payments)
            {
                p.Status = PaymentStatus.Failed;
                p.UpdatedAt = failedAt;
            }
            await db.SaveChangesAsync();
            return StatusCode(StatusCodes.Status502BadGateway, $"Could not initiate payment: {ex.Message}");
        }

        return Ok(new InitiatePaymentResultDto
        {
            OrderId = orderId,
            Token = tokenResult.Token!
        });
    }

    [HttpPost("Callback")]
    public async Task<IActionResult> Callback([FromBody] Dictionary<string, JsonElement>? body)
    {
        if (body is null || body.Count == 0) return Ok(); // acknowledge; nothing actionable

        var parameters = FlittSignature.Flatten(body);

        if (!flitt.VerifySignature(parameters))
        {
            logger.LogWarning("Flitt callback with invalid signature for order {OrderId}",
                parameters.GetValueOrDefault("order_id"));
            return Ok(); // never leak detail; just acknowledge
        }

        var orderId = parameters.GetValueOrDefault("order_id");
        if (string.IsNullOrWhiteSpace(orderId)) return Ok();

        var payments = await db.Payments.Where(x => x.MerchantPaymentId == orderId).ToListAsync();
        if (payments.Count == 0)
        {
            logger.LogWarning("Flitt callback for unknown order {OrderId}", orderId);
            return Ok();
        }

        await ApplyOutcomeAsync(payments, parameters);

        return Ok();
    }

    [HttpPost("Return")]
    [HttpGet("Return")]
    public async Task<IActionResult> Return()
    {
        string? orderId = null;

        // Flitt posts the result as form-encoded data on the hard redirect.
        if (Request.HasFormContentType)
        {
            var form = await Request.ReadFormAsync();
            orderId = FirstNonEmpty(form["order_id"], form["orderId"]);
        }
        // Fall back to the query string (covers GET returns and manual navigation).
        orderId ??= FirstNonEmpty(Request.Query["order_id"], Request.Query["orderId"]);

        var clientUrl = string.IsNullOrWhiteSpace(_options.ClientReturnUrl)
            ? "/"
            : _options.ClientReturnUrl;

        var target = string.IsNullOrWhiteSpace(orderId)
            ? clientUrl
            : QueryHelpers.AddQueryString(clientUrl, "orderId", orderId);

        // 303 See Other forces the browser to issue a GET to the SPA (so nginx serves it fine),
        // regardless of whether Flitt arrived here via POST or GET.
        Response.Headers.Location = target;
        return StatusCode(StatusCodes.Status303SeeOther);
    }

    [HttpGet("GetStatus")]
    public async Task<IActionResult> GetStatus(string orderId)
    {
        var payments = await db.Payments
            .Where(x => x.MerchantPaymentId == orderId)
            .ToListAsync();
        if (payments.Count == 0) return NotFound();

        if (payments.Any(p => !IsFinal(p.Status)))
        {
            try
            {
                var order = await flitt.GetOrderStatusAsync(orderId);
                if (order.ErrorCode is null && (order.SignatureValid || order.OrderStatus is not null))
                {
                    await ApplyOutcomeAsync(payments, order.Parameters);
                }
            }
            catch (FlittPaymentException ex)
            {
                // Don't fail the poll on a transient lookup error — just return what we have.
                logger.LogDebug(ex, "Order-status reconcile failed for {OrderId}", orderId);
            }
        }

        var final = payments.All(p => IsFinal(p.Status));
        return Ok(new PaymentBatchStatusDto
        {
            OrderId = orderId,
            Status = OverallStatus(payments, final).ToString(),
            Final = final,
            Amount = payments.Sum(p => p.Amount),
            Currency = payments[0].Currency,
            Items = payments
                .OrderBy(p => p.Id)
                .Select(p => new PaymentItemStatusDto
                {
                    ServiceTokenId = p.ServiceTokenId,
                    Status = p.Status.ToString()
                })
                .ToList()
        });
    }

    // ───── helpers ────────────────────────────────────────────────────────────

    private static bool IsFinal(PaymentStatus s) =>
        s is PaymentStatus.Succeeded or PaymentStatus.Failed
          or PaymentStatus.Cancelled or PaymentStatus.Expired;

    private static string? FirstNonEmpty(params Microsoft.Extensions.Primitives.StringValues[] values)
    {
        foreach (var v in values)
        {
            var s = v.ToString();
            if (!string.IsNullOrWhiteSpace(s)) return s;
        }
        return null;
    }

    private static PaymentStatus OverallStatus(List<Payment> payments, bool final)
    {
        if (!final) return PaymentStatus.Processing;
        if (payments.Any(p => p.Status == PaymentStatus.Succeeded)) return PaymentStatus.Succeeded;
        if (payments.All(p => p.Status == PaymentStatus.Cancelled)) return PaymentStatus.Cancelled;
        if (payments.All(p => p.Status == PaymentStatus.Expired)) return PaymentStatus.Expired;
        return PaymentStatus.Failed;
    }

    private async Task ApplyOutcomeAsync(List<Payment> payments, IReadOnlyDictionary<string, string> p)
    {
        var orderStatus = p.GetValueOrDefault("order_status");
        var paymentId = p.GetValueOrDefault("payment_id");

        var pending = payments.Where(x => !IsFinal(x.Status)).ToList();
        if (pending.Count == 0)
        {
            // Already finalized earlier; still make sure the split happened (e.g. it failed before).
            await TrySettleOrderAsync(payments);
            return;
        }

        var status = flitt.MapStatus(orderStatus);
        var now = DateTime.UtcNow;
        var anySucceeded = false;

        foreach (var payment in pending)
        {
            payment.ProviderStatus = orderStatus;
            if (!string.IsNullOrEmpty(paymentId)) payment.PayId = paymentId;
            payment.UpdatedAt = now;

            if (status == PaymentStatus.Succeeded)
            {
                // Each token is finalized independently: one token that is no longer purchasable
                // fails on its own without blocking the others in the same order.
                var finalized = await FinalizePrimaryPurchaseAsync(payment);
                payment.Status = finalized ? PaymentStatus.Succeeded : PaymentStatus.Failed;
                if (finalized) anySucceeded = true;
            }
            else
            {
                payment.Status = status;
            }
        }

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException ex)
        {
            // A concurrent finalization won the race; that's fine.
            logger.LogWarning(ex, "Concurrent update finalizing order {OrderId}", payments[0].MerchantPaymentId);
            return;
        }

        if (anySucceeded)
        {
            // Persist the reusable card token (if any) and split the captured funds. Both are
            // best-effort and must never undo a completed purchase, so failures are only logged.
            await SaveCustomerCardTokenAsync(payments[0].CustomerPublicKey, p);
            await TrySettleOrderAsync(payments);
        }
    }

    private async Task TrySettleOrderAsync(List<Payment> payments)
    {
        // Idempotency: never settle twice.
        if (payments.Any(x => x.SettledAt is not null)) return;

        var succeeded = payments.Where(x => x.Status == PaymentStatus.Succeeded).ToList();
        if (succeeded.Count == 0) return;

        var orderId = payments[0].MerchantPaymentId;
        var currency = payments[0].Currency;
        var feePercent = _options.FeePercentPerToken;

        // Resolve each paid token's issuing company.
        var tokenIds = succeeded.Select(x => x.ServiceTokenId).ToList();
        var tokenCompany = await db.ServiceTokens
            .Where(t => tokenIds.Contains(t.Id))
            .Select(t => new { t.Id, t.CompanyId })
            .ToListAsync();
        var companyByToken = tokenCompany.ToDictionary(x => x.Id, x => x.CompanyId);

        // Per-company company share (price − fee) and the platform's total fee.
        var companyShare = new Dictionary<long, decimal>();
        decimal totalFee = 0m;
        foreach (var pay in succeeded)
        {
            if (!companyByToken.TryGetValue(pay.ServiceTokenId, out var companyId)) continue;
            var fee = Math.Round(pay.Amount * feePercent / 100m, 2, MidpointRounding.AwayFromZero);
            if (fee < 0) fee = 0;
            if (fee > pay.Amount) fee = pay.Amount;
            totalFee += fee;
            companyShare[companyId] = companyShare.GetValueOrDefault(companyId) + (pay.Amount - fee);
        }

        // Look up the payout IBAN for each participating company.
        var companyIds = companyShare.Keys.ToList();
        var accounts = await db.CompanyBankAccounts
            .Where(a => companyIds.Contains(a.CompanyId))
            .ToListAsync();
        var accountByCompany = accounts.ToDictionary(a => a.CompanyId);

        var receivers = new List<FlittSettlementReceiver>();
        long distributedMinor = 0;

        foreach (var (companyId, share) in companyShare)
        {
            if (share <= 0) continue;
            if (!accountByCompany.TryGetValue(companyId, out var acc) || string.IsNullOrWhiteSpace(acc.Iban))
            {
                // No payout account on file — leave this company's share in the platform account
                // for manual reconciliation rather than failing the whole split.
                logger.LogWarning("Company {CompanyId} has no bank account; its share of order {OrderId} was not settled.",
                    companyId, orderId);
                continue;
            }

            var minor = ToMinor(share);
            distributedMinor += minor;
            receivers.Add(new FlittSettlementReceiver
            {
                Type = "bank",
                // NOTE: the exact requisites field names for a bank-account receiver are not in the
                // public Flitt docs. They mirror the IBAN-withdrawal fields (receiver_iban/_name).
                // If Flitt expects different names, adjust them here only.
                Requisites = new Dictionary<string, object?>
                {
                    ["amount"] = minor,
                    ["iban"] = acc.Iban,
                    ["name"] = string.IsNullOrWhiteSpace(acc.BeneficiaryName) ? null : acc.BeneficiaryName,
                    ["settlement_description"] = $"Payout for order {orderId}"
                }
            });
        }

        if (receivers.Count == 0)
        {
            logger.LogWarning("Order {OrderId} had nothing to settle (no company payout accounts).", orderId);
            return;
        }

        // Platform fee receiver (optional): the fee goes to the platform IBAN from configuration.
        // If no platform IBAN is configured the fee simply stays in the platform's Flitt account.
        if (totalFee > 0 && !string.IsNullOrWhiteSpace(_general.PlatformBankIban))
        {
            var feeMinor = ToMinor(totalFee);
            distributedMinor += feeMinor;
            receivers.Add(new FlittSettlementReceiver
            {
                Type = "bank",
                Requisites = new Dictionary<string, object?>
                {
                    ["amount"] = feeMinor,
                    ["iban"] = _general.PlatformBankIban,
                    ["name"] = string.IsNullOrWhiteSpace(_general.PlatformBankName) ? null : _general.PlatformBankName,
                    ["settlement_description"] = $"Platform fee for order {orderId}"
                }
            });
        }

        var settlementOrder = new FlittSettlementOrder
        {
            OrderId = "settlement_" + orderId,
            OperationId = orderId,
            OrderType = "settlement",
            MerchantId = _options.MerchantId,
            Amount = distributedMinor,
            Currency = currency,
            OrderDesc = $"Settlement for order {orderId}",
            ServerCallbackUrl = string.IsNullOrWhiteSpace(_options.ServerCallbackUrl) ? null : _options.ServerCallbackUrl,
            Receiver = receivers
        };

        FlittSettlementResult result;
        try
        {
            result = await flitt.SettlementAsync(settlementOrder);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Settlement request threw for order {OrderId}", orderId);
            return; // leave SettledAt null so a later poll/callback can retry the split
        }

        if (!result.IsSuccess)
        {
            logger.LogError("Settlement declined for order {OrderId}: {Code} {Message} {Body}",
                orderId, result.ErrorCode, result.ErrorMessage, result.RawBody);
            return; // retryable on the next callback / poll
        }

        var settledAt = DateTime.UtcNow;
        foreach (var pay in payments)
        {
            pay.SettlementStatus = result.ResponseStatus;
            pay.SettledAt = settledAt;
            pay.UpdatedAt = settledAt;
        }

        try
        {
            await db.SaveChangesAsync();
            logger.LogInformation("Order {OrderId} settled: {Count} receiver(s), fee {Fee}.",
                orderId, receivers.Count, totalFee);
        }
        catch (DbUpdateConcurrencyException ex)
        {
            logger.LogWarning(ex, "Concurrent update recording settlement for order {OrderId}", orderId);
        }
    }
    private async Task SaveCustomerCardTokenAsync(string customerPublicKey, IReadOnlyDictionary<string, string> p)
    {
        var rectoken = p.GetValueOrDefault("rectoken");
        if (string.IsNullOrWhiteSpace(rectoken)) return;

        var customer = await db.Customers.FirstOrDefaultAsync(x => x.PublicKey == customerPublicKey);
        if (customer is null)
        {
            logger.LogWarning("Cannot save card token: no customer with public key for finalized order.");
            return;
        }

        var lifetime = ParseFlittDate(p.GetValueOrDefault("rectoken_lifetime"));
        var maskedCard = p.GetValueOrDefault("masked_card");
        var cardType = p.GetValueOrDefault("card_type");
        var paymentSystem = p.GetValueOrDefault("payment_system");
        var now = DateTime.UtcNow;

        var method = await db.CustomerPaymentMethods.FirstOrDefaultAsync(x => x.CustomerId == customer.Id);
        if (method is null)
        {
            db.CustomerPaymentMethods.Add(new CustomerPaymentMethod
            {
                CustomerId = customer.Id,
                CardToken = rectoken,
                MaskedCard = maskedCard,
                CardType = cardType,
                PaymentSystem = paymentSystem,
                TokenLifetime = lifetime,
                CreatedAt = now,
                UpdatedAt = now
            });
        }
        else
        {
            method.CardToken = rectoken;
            method.MaskedCard = maskedCard;
            method.CardType = cardType;
            method.PaymentSystem = paymentSystem;
            method.TokenLifetime = lifetime;
            method.UpdatedAt = now;
        }

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex)
        {
            logger.LogWarning(ex, "Failed to save card token for customer {CustomerId}", customer.Id);
        }
    }

    private static long ToMinor(decimal amount) =>
        (long)Math.Round(amount * 100m, MidpointRounding.AwayFromZero);

    private static DateTime? ParseFlittDate(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        foreach (var fmt in new[] { "dd.MM.yyyy HH:mm:ss", "dd.MM.yyyy" })
        {
            if (DateTime.TryParseExact(s, fmt, System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.AssumeUniversal | System.Globalization.DateTimeStyles.AdjustToUniversal,
                out var dt))
                return dt;
        }
        return null;
    }

    private async Task<bool> FinalizePrimaryPurchaseAsync(Payment payment)
    {
        var serviceToken = await db.ServiceTokens
            .FirstOrDefaultAsync(x => x.Id == payment.ServiceTokenId && x.Status == ServiceTokenStatus.InCart);
        if (serviceToken is null)
        {
            logger.LogWarning("Paid token {TokenId} no longer in cart at finalization", payment.ServiceTokenId);
            return false;
        }

        var term = (await db.Products
                .Where(x => x.Id == serviceToken.ProductId)
                .Select(x => x.Term)
                .SingleAsync())
            .GetValueOrDefault();

        var startDate = DateTime.UtcNow.Date;
        serviceToken.Status = ServiceTokenStatus.Sold;
        serviceToken.StartDate = startDate;
        serviceToken.EndDate = startDate.AddMonths(term);
        serviceToken.OwnerType = OwnerType.Customer;
        serviceToken.OwnerPublicKey = payment.CustomerPublicKey;

        db.Operations.Add(new Operation
        {
            ServiceTokenId = serviceToken.Id,
            OpType = OpType.BuyPrimary,
            OpDate = DateTime.UtcNow,
            OwnerPublicKey = serviceToken.OwnerPublicKey
        });

        var inCart = await db.ServiceTokenInCart.FirstOrDefaultAsync(x => x.ServiceTokenId == serviceToken.Id);
        if (inCart is not null) db.ServiceTokenInCart.Remove(inCart);

        return true;
    }
}
