using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ServiceTokenApi.Migrations
{
    /// <inheritdoc />
    public partial class AddUniqueKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_CompanyUsers_UserName",
                table: "CompanyUsers",
                column: "UserName",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_CompanyUsers_UserName",
                table: "CompanyUsers");
        }
    }
}
