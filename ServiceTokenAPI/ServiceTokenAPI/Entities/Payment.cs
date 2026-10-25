using System.ComponentModel.DataAnnotations;
using ServiceTokenApi.Enums;

namespace ServiceTokenApi.Entities
{
    /// <summary>
    /// Records a single Flitt payment intent and links it back to the service token being
    /// purchased and the buyer. The Flitt callback / order-status lookup uses
    /// <see cref="MerchantPaymentId"/> (our order_id) to find this row and finalize the purchase.
    /// </summary>
    public class Payment
    {
        public long Id { get; set; }

        [Timestamp]
        public uint RowVersion { get; set; }

        /// <summary>Our own identifier, sent to Flitt as <c>order_id</c>.</summary>
        public string MerchantPaymentId { get; set; } = null!;

        /// <summary>Flitt-side payment id (<c>payment_id</c>). Null until the first payment attempt.</summary>
        public string? PayId { get; set; }

        /// <summary>The service token this payment buys.</summary>
        public string ServiceTokenId { get; set; } = null!;

        /// <summary>Buyer (customer) public key.</summary>
        public string CustomerPublicKey { get; set; } = null!;

        public decimal Amount { get; set; }

        public string Currency { get; set; } = "GEL";

        public PaymentStatus Status { get; set; }

        /// <summary>Raw <c>order_status</c> string last reported by Flitt, kept for diagnostics.</summary>
        public string? ProviderStatus { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime UpdatedAt { get; set; }

        /// <summary>
        /// Status of the post-payment split (settlement) for this order: null until attempted,
        /// then the Flitt response_status ("success"/"failure"). Used to make settlement idempotent.
        /// </summary>
        public string? SettlementStatus { get; set; }

        /// <summary>When the split (settlement) request was sent for this order. Null until settled.</summary>
        public DateTime? SettledAt { get; set; }
    }
}
