using System.Globalization;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using ServiceTokenApi.Enums;
using ServiceTokenApi.Options;

namespace ServiceTokenApi.Services.Flitt
{
    /// <summary>
    /// Raised when a call to the Flitt API fails. Carries a safe, user-facing-ish message;
    /// full diagnostics are logged separately.
    /// </summary>
    public sealed class FlittPaymentException(string message) : Exception(message);

    public sealed class FlittPaymentService(
        HttpClient http,
        IOptions<FlittOptions> options,
        ILogger<FlittPaymentService> logger) : IFlittPaymentService
    {
        private readonly FlittOptions _options = options.Value;
        private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

        public async Task<FlittTokenResult> CreateOrderAsync(decimal amount, string orderId, string description, bool requiredRectoken = false, CancellationToken ct = default)
        {
            // Flitt expects the amount in minor units (e.g. tetri): 12.50 GEL → 1250.
            var minorAmount = (long)Math.Round(amount * 100m, MidpointRounding.AwayFromZero);

            var request = new FlittCreateOrderRequest
            {
                OrderId = orderId,
                MerchantId = _options.MerchantId,
                Amount = minorAmount,
                Currency = _options.Currency,
                OrderDesc = description,
                ServerCallbackUrl = NullIfBlank(_options.ServerCallbackUrl),
                ResponseUrl = NullIfBlank(_options.ResponseUrl),
                Lifetime = _options.LifetimeSeconds > 0 ? _options.LifetimeSeconds : null,
                RequiredRectoken = requiredRectoken ? "Y" : null
            };

            // Sign over exactly the (non-empty) parameters we send.
            var signatureParams = new List<KeyValuePair<string, string?>>
            {
                new("order_id", request.OrderId),
                new("merchant_id", request.MerchantId.ToString(CultureInfo.InvariantCulture)),
                new("amount", request.Amount.ToString(CultureInfo.InvariantCulture)),
                new("currency", request.Currency),
                new("order_desc", request.OrderDesc),
                new("server_callback_url", request.ServerCallbackUrl),
                new("response_url", request.ResponseUrl),
                new("lifetime", request.Lifetime?.ToString(CultureInfo.InvariantCulture)),
                new("required_rectoken", request.RequiredRectoken)
            };
            request.Signature = FlittSignature.Build(_options.SecretKey, signatureParams);

            var envelope = new FlittRequestEnvelope<FlittCreateOrderRequest> { Request = request };

            using var resp = await http.PostAsJsonAsync("checkout/token", envelope, JsonOpts, ct);
            var raw = await resp.Content.ReadAsStringAsync(ct);

            if (!resp.IsSuccessStatusCode)
            {
                logger.LogError("Flitt create-order failed: {Status} {Body}", (int)resp.StatusCode, raw);
                throw new FlittPaymentException($"Flitt create-order failed (HTTP {(int)resp.StatusCode}): {Trim(raw)}");
            }

            using var doc = JsonDocument.Parse(raw);
            if (!doc.RootElement.TryGetProperty("response", out var response))
                throw new FlittPaymentException("Unexpected create-order response from Flitt.");

            var responseStatus = GetString(response, "response_status") ?? string.Empty;
            var result = new FlittTokenResult
            {
                Token = GetString(response, "token"),
                ResponseStatus = responseStatus,
                ErrorCode = response.TryGetProperty("error_code", out var ec) && ec.ValueKind == JsonValueKind.Number ? ec.GetInt32() : null,
                ErrorMessage = GetString(response, "error_message")
            };

            if (!result.IsSuccess)
            {
                logger.LogError("Flitt create-order returned failure: {Code} {Message}", result.ErrorCode, result.ErrorMessage);
                throw new FlittPaymentException(result.ErrorMessage ?? "Flitt did not return a checkout token.");
            }

            return result;
        }

        public async Task<FlittOrderResult> GetOrderStatusAsync(string orderId, CancellationToken ct = default)
        {
            var signatureParams = new List<KeyValuePair<string, string?>>
            {
                new("order_id", orderId),
                new("merchant_id", _options.MerchantId.ToString(CultureInfo.InvariantCulture)),
                new("version", "1.0.1")
            };
            var signature = FlittSignature.Build(_options.SecretKey, signatureParams);

            var envelope = new
            {
                request = new
                {
                    order_id = orderId,
                    merchant_id = _options.MerchantId.ToString(CultureInfo.InvariantCulture),
                    version = "1.0.1",
                    signature
                }
            };

            using var resp = await http.PostAsJsonAsync("status/order_id", envelope, JsonOpts, ct);
            var raw = await resp.Content.ReadAsStringAsync(ct);

            if (!resp.IsSuccessStatusCode)
            {
                logger.LogError("Flitt order-status failed: {Status} {Body}", (int)resp.StatusCode, raw);
                throw new FlittPaymentException($"Flitt order-status failed (HTTP {(int)resp.StatusCode}): {Trim(raw)}");
            }

            using var doc = JsonDocument.Parse(raw);
            if (!doc.RootElement.TryGetProperty("response", out var response)
                || response.ValueKind != JsonValueKind.Object)
                throw new FlittPaymentException("Unexpected order-status response from Flitt.");

            var flat = FlittSignature.Flatten(
                response.EnumerateObject().ToDictionary(p => p.Name, p => p.Value));

            // An error envelope (e.g. order not found yet) has no signature to verify.
            var hasError = flat.ContainsKey("error_code");
            var valid = !hasError && VerifySignature(flat);

            if (!hasError && !valid)
                logger.LogWarning("Flitt order-status signature mismatch for order {OrderId}", orderId);

            return new FlittOrderResult { Parameters = flat, SignatureValid = valid };
        }

        public bool VerifySignature(IReadOnlyDictionary<string, string> parameters) =>
            FlittSignature.Verify(_options.SecretKey, parameters);

        public async Task<FlittSettlementResult> SettlementAsync(FlittSettlementOrder order, CancellationToken ct = default)
        {
            // The settlement body is { "request": { "version": 2.0, "data": <base64(order)>, "signature": <sha1> } }.
            // `data` is the base64 of { "order": { ... } }; the signature is sha1(payoutSecret + '|' + data).
            var dataOpts = new JsonSerializerOptions(JsonOpts)
            {
                DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
            };
            var orderJson = JsonSerializer.Serialize(new { order }, dataOpts);
            var data = Convert.ToBase64String(Encoding.UTF8.GetBytes(orderJson));
            var signature = FlittSignature.BuildForData(_options.PayoutSecretKey, data);

            var envelope = new
            {
                request = new
                {
                    version = "2.0",
                    data,
                    signature
                }
            };

            using var resp = await http.PostAsJsonAsync("settlement", envelope, JsonOpts, ct);
            var raw = await resp.Content.ReadAsStringAsync(ct);

            if (!resp.IsSuccessStatusCode)
            {
                logger.LogError("Flitt settlement failed: {Status} {Body}", (int)resp.StatusCode, raw);
                return new FlittSettlementResult
                {
                    ResponseStatus = "failure",
                    ErrorMessage = $"HTTP {(int)resp.StatusCode}",
                    RawBody = Trim(raw)
                };
            }

            try
            {
                using var doc = JsonDocument.Parse(raw);
                var root = doc.RootElement.TryGetProperty("response", out var r) ? r : doc.RootElement;

                return new FlittSettlementResult
                {
                    ResponseStatus = GetString(root, "response_status") ?? "success",
                    ErrorCode = root.TryGetProperty("error_code", out var ec) && ec.ValueKind == JsonValueKind.Number ? ec.GetInt32() : null,
                    ErrorMessage = GetString(root, "error_message"),
                    RawBody = Trim(raw)
                };
            }
            catch (JsonException)
            {
                return new FlittSettlementResult { ResponseStatus = "success", RawBody = Trim(raw) };
            }
        }

        // Flitt order_status vocabulary: created, processing, approved, declined, expired, reversed.
        public PaymentStatus MapStatus(string? orderStatus) => orderStatus?.Trim().ToLowerInvariant() switch
        {
            "approved" => PaymentStatus.Succeeded,
            "declined" => PaymentStatus.Failed,
            "expired" => PaymentStatus.Expired,
            "reversed" or "reverse" => PaymentStatus.Cancelled,
            "processing" => PaymentStatus.Processing,
            "created" => PaymentStatus.Created,
            null or "" => PaymentStatus.None,
            _ => PaymentStatus.Processing
        };

        // ───── helpers ───────────────────────────────────────────────────────────

        private static string? GetString(JsonElement obj, string name) =>
            obj.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

        private static string? NullIfBlank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s;

        private static string Trim(string? body) =>
            string.IsNullOrWhiteSpace(body) ? "(no detail)"
            : body.Length > 300 ? body[..300] : body;
    }
}
