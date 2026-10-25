using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ServiceTokenApi.Entities;

namespace ServiceTokenApi.Configurations
{
    public class CustomerPaymentMethodConfiguration : IEntityTypeConfiguration<CustomerPaymentMethod>
    {
        public void Configure(EntityTypeBuilder<CustomerPaymentMethod> builder)
        {
            builder.ToTable("CustomerPaymentMethods");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.RowVersion).IsRowVersion();

            // One-to-one: a customer has at most one saved payment method.
            builder.HasIndex(x => x.CustomerId).IsUnique();
            builder.HasOne(x => x.Customer)
                   .WithOne(i => i.PaymentMethod)
                   .HasForeignKey<CustomerPaymentMethod>(x => x.CustomerId)
                   .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
