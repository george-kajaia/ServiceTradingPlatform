using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ServiceTokenApi.Entities;

namespace ServiceTokenApi.Configurations
{
    public class CompanyBankAccountConfiguration : IEntityTypeConfiguration<CompanyBankAccount>
    {
        public void Configure(EntityTypeBuilder<CompanyBankAccount> builder)
        {
            builder.ToTable("CompanyBankAccounts");
            builder.HasKey(x => x.CompanyId);
            builder.Property(x => x.RowVersion).IsRowVersion();

            // One-to-one: a company has at most one payout account.
            builder.HasIndex(x => x.CompanyId).IsUnique();
            builder.HasOne(x => x.Company)
                   .WithOne(c => c.BankAccount)
                   .HasForeignKey<CompanyBankAccount>(x => x.CompanyId)
                   .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
