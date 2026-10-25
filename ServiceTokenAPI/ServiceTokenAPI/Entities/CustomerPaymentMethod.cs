using System.ComponentModel.DataAnnotations;

namespace ServiceTokenApi.Entities
{
    /// <summary>
    /// A saved payment instrument for a customer. One-to-one with <see cref="Customer"/>.
    /// Only the provider-issued card TOKEN (Flitt <c>rectoken</c>) is stored — never the PAN,
    /// expiry or CVV. The masked card and card type are kept purely for display. An IBAN field
    /// is provided for customers who supply a bank account instead of a card.
    /// </summary>
    public class CustomerPaymentMethod
    {
        public long Id { get; set; }

        [Timestamp]
        public uint RowVersion { get; set; }

        /// <summary>Owning customer (unique — enforces the one-to-one relationship).</summary>
        public long CustomerId { get; set; }

        /// <summary>Flitt card token (<c>rectoken</c>) used for repeat charges. No PAN is ever stored.</summary>
        public string? CardToken { get; set; }

        /// <summary>Masked card for display only, e.g. <c>444455XXXXXX1111</c>.</summary>
        public string? MaskedCard { get; set; }

        /// <summary>Card brand for display, e.g. VISA / MasterCard.</summary>
        public string? CardType { get; set; }

        /// <summary>Payment system reported by Flitt (e.g. card).</summary>
        public string? PaymentSystem { get; set; }

        /// <summary>Token expiry as reported by Flitt (<c>rectoken_lifetime</c>), if any.</summary>
        public DateTime? TokenLifetime { get; set; }

        /// <summary>Optional bank account (IBAN) the customer supplied instead of a card.</summary>
        public string? Iban { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime UpdatedAt { get; set; }

        public Customer? Customer { get; set; }
    }
}
