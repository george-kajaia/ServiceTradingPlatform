using System.ComponentModel.DataAnnotations;

namespace ServiceTokenApi.Entities
{
    public class Customer
    {
        public long Id { get; set; }
        [Timestamp]
        public uint RowVersion { get; set; }
        public string PublicKey { get; set; } = string.Empty;
        public byte Status { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;

        /// <summary>The customer's saved payment method (one-to-one): stores only a card token, never the PAN.</summary>
        public CustomerPaymentMethod? PaymentMethod { get; set; }
    }
}
