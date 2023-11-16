using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PersonalSiteAPI.Migrations
{
    /// <inheritdoc />
    public partial class SizeLimitOnName : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            //migrationBuilder.DropIndex(
            //    name: "IX_Studies_Name",
            //    table: "Studies");

            migrationBuilder.AlterColumn<string>(
                name: "Name",
                table: "Studies",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Name",
                table: "Studies",
                type: "nvarchar(450)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(200)",
                oldMaxLength: 200);

            //migrationBuilder.CreateIndex(
            //    name: "IX_Studies_Name",
            //    table: "Studies",
            //    column: "Name");
        }
    }
}
