namespace ServiceTokenApi.Enums
{
    /// <summary>
    /// Platform-wide settings, bound from the "GeneralOptions" configuration section.
    /// Holds the platform's own bank account, which receives the platform fee when a
    /// customer payment is split (settled) between the issuing company and the platform.
    /// </summary>
    public class GeneralOptions
    {
        /// <summary>Legacy platform account identifier (kept for backward compatibility).</summary>
        public string PlatformAccount { get; set; } = string.Empty;

        /// <summary>IBAN of the platform bank account that receives the platform fee on each split.</summary>
        public string PlatformBankIban { get; set; } = string.Empty;

        /// <summary>Beneficiary name of the platform bank account (shown on the settlement transfer).</summary>
        public string PlatformBankName { get; set; } = string.Empty;
    }
}
