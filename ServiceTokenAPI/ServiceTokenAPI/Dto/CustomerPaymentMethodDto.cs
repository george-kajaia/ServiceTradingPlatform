namespace ServiceTokenApi.Dto
{
    /// <summary>
    /// A safe view of a customer's saved payment method. The raw card token is NEVER returned to
    /// clients — only whether one exists, plus the masked card and display fields.
    /// </summary>
    public class CustomerPaymentMethodDto
    {
        public bool HasSavedCard { get; set; }
        public string? MaskedCard { get; set; }
        public string? CardType { get; set; }
        public string? PaymentSystem { get; set; }
        public DateTime? TokenLifetime { get; set; }
        public string? Iban { get; set; }
    }
}
