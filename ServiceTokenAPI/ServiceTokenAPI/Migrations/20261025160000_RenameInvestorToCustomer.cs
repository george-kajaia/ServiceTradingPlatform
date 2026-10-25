using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ServiceTokenApi.Migrations
{
    /// <summary>
    /// Renames the Investor concept to Customer. Rename-only: every table, column, key and
    /// index keeps its data; nothing is dropped or recreated.
    /// </summary>
    public partial class RenameInvestorToCustomer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Tables
            migrationBuilder.RenameTable(name: "Investors", newName: "Customers");
            migrationBuilder.RenameTable(name: "InvestorPaymentMethods", newName: "CustomerPaymentMethods");

            // Columns
            migrationBuilder.RenameColumn(name: "InvestorId", table: "CustomerPaymentMethods", newName: "CustomerId");
            migrationBuilder.RenameColumn(name: "InvestorPublicKey", table: "Payments", newName: "CustomerPublicKey");

            // Indexes
            migrationBuilder.RenameIndex(name: "IX_InvestorPaymentMethods_InvestorId", table: "CustomerPaymentMethods", newName: "IX_CustomerPaymentMethods_CustomerId");
            migrationBuilder.RenameIndex(name: "IX_Payments_InvestorPublicKey", table: "Payments", newName: "IX_Payments_CustomerPublicKey");

            // Primary and foreign key constraints (names follow EF conventions so later migrations line up)
            migrationBuilder.Sql("ALTER TABLE \"Customers\" RENAME CONSTRAINT \"PK_Investors\" TO \"PK_Customers\";");
            migrationBuilder.Sql("ALTER TABLE \"CustomerPaymentMethods\" RENAME CONSTRAINT \"PK_InvestorPaymentMethods\" TO \"PK_CustomerPaymentMethods\";");
            migrationBuilder.Sql("ALTER TABLE \"CustomerPaymentMethods\" RENAME CONSTRAINT \"FK_InvestorPaymentMethods_Investors_InvestorId\" TO \"FK_CustomerPaymentMethods_Customers_CustomerId\";");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("ALTER TABLE \"CustomerPaymentMethods\" RENAME CONSTRAINT \"FK_CustomerPaymentMethods_Customers_CustomerId\" TO \"FK_InvestorPaymentMethods_Investors_InvestorId\";");
            migrationBuilder.Sql("ALTER TABLE \"CustomerPaymentMethods\" RENAME CONSTRAINT \"PK_CustomerPaymentMethods\" TO \"PK_InvestorPaymentMethods\";");
            migrationBuilder.Sql("ALTER TABLE \"Customers\" RENAME CONSTRAINT \"PK_Customers\" TO \"PK_Investors\";");

            migrationBuilder.RenameIndex(name: "IX_Payments_CustomerPublicKey", table: "Payments", newName: "IX_Payments_InvestorPublicKey");
            migrationBuilder.RenameIndex(name: "IX_CustomerPaymentMethods_CustomerId", table: "CustomerPaymentMethods", newName: "IX_InvestorPaymentMethods_InvestorId");

            migrationBuilder.RenameColumn(name: "CustomerPublicKey", table: "Payments", newName: "InvestorPublicKey");
            migrationBuilder.RenameColumn(name: "CustomerId", table: "CustomerPaymentMethods", newName: "InvestorId");

            migrationBuilder.RenameTable(name: "CustomerPaymentMethods", newName: "InvestorPaymentMethods");
            migrationBuilder.RenameTable(name: "Customers", newName: "Investors");
        }
    }
}
