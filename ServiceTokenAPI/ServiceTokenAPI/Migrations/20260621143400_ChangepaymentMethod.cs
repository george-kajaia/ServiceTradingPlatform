using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ServiceTokenApi.Migrations
{
    /// <inheritdoc />
    public partial class ChangepaymentMethod : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "SettledAt",
                table: "Payments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SettlementStatus",
                table: "Payments",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "CompanyBankAccounts",
                columns: table => new
                {
                    CompanyId = table.Column<long>(type: "bigint", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    Iban = table.Column<string>(type: "text", nullable: false),
                    BeneficiaryName = table.Column<string>(type: "text", nullable: false),
                    BankName = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CompanyBankAccounts", x => x.CompanyId);
                    table.ForeignKey(
                        name: "FK_CompanyBankAccounts_Companies_CompanyId",
                        column: x => x.CompanyId,
                        principalTable: "Companies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "InvestorPaymentMethods",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    InvestorId = table.Column<long>(type: "bigint", nullable: false),
                    CardToken = table.Column<string>(type: "text", nullable: true),
                    MaskedCard = table.Column<string>(type: "text", nullable: true),
                    CardType = table.Column<string>(type: "text", nullable: true),
                    PaymentSystem = table.Column<string>(type: "text", nullable: true),
                    TokenLifetime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Iban = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InvestorPaymentMethods", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InvestorPaymentMethods_Investors_InvestorId",
                        column: x => x.InvestorId,
                        principalTable: "Investors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CompanyBankAccounts_CompanyId",
                table: "CompanyBankAccounts",
                column: "CompanyId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_InvestorPaymentMethods_InvestorId",
                table: "InvestorPaymentMethods",
                column: "InvestorId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CompanyBankAccounts");

            migrationBuilder.DropTable(
                name: "InvestorPaymentMethods");

            migrationBuilder.DropColumn(
                name: "SettledAt",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "SettlementStatus",
                table: "Payments");
        }
    }
}
