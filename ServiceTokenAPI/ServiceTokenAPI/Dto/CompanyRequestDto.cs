namespace ServiceTokenApi.Dto
{
    public class CompanyRequestDto
    {
        public string Name { get; set; } = string.Empty;

        public string TaxCode { get; set; } = string.Empty;

        public string Address { get; set; } = string.Empty;

        public byte LegalForm { get; set; }

        public int EconomicActivity { get; set; }

        public string Mail { get; set; } = string.Empty;

        public string Phone { get; set; } = string.Empty;

        public string UserName { get; set; } = string.Empty;
        
        public string Password { get; set; } = string.Empty;

        // ── Payout bank account (one-to-one). The company is paid into this IBAN when a
        //    customer's card payment is split; the company is NOT a Flitt merchant. ──
        public string BankAccountIban { get; set; } = string.Empty;

        public string BankAccountName { get; set; } = string.Empty;

        public string BankName { get; set; } = string.Empty;
    }
}
