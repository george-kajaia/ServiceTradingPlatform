using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ServiceTokenApi.Entities;

namespace ServiceTokenApi.Configurations
{
    public class CustomerConfiguration : IEntityTypeConfiguration<Customer>
    {
        public void Configure(EntityTypeBuilder<Customer> builder)
        {
            builder.ToTable("Customers");
            builder.HasKey(item => item.Id);
            builder.Property(x => x.RowVersion).IsRowVersion();
        }
    }
}