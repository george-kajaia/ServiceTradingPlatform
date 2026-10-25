using System.ComponentModel.DataAnnotations;

namespace ServiceTokenApi.Entities
{
    /// <summary>
    /// The bank account a company is paid into when a customer's card payment is split.
    /// One-to-one with <see cref="Company"/>: each company has at most one payout account.
    /// Companies are NOT Flitt sub-merchants — the settlement transfers funds directly to this IBAN.
    /// </summary>
    public class CompanyBankAccount
    {
        [Timestamp]
        public uint RowVersion { get; set; }

        /// <summary>Owning company (unique — enforces the one-to-one relationship).</summary>
        public long CompanyId { get; set; }

        /// <summary>IBAN the company is paid into.</summary>
        public string Iban { get; set; } = string.Empty;

        /// <summary>Beneficiary name as it should appear on the transfer.</summary>
        public string BeneficiaryName { get; set; } = string.Empty;

        /// <summary>Optional bank name (informational).</summary>
        public string BankName { get; set; } = string.Empty;

        public Company? Company { get; set; }
    }
}
