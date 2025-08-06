using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WildlifeTrackerAPI.Migrations
{
    /// <inheritdoc />
    public partial class SizeLimit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            //migrationBuilder.DropIndex(
            //    name: "IX_Studies_Id_Name",
            //    table: "Studies");

            migrationBuilder.AlterColumn<string>(
                name: "LicenseType",
                table: "Studies",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            //migrationBuilder.CreateIndex(
            //    name: "IX_Studies_Name",
            //    table: "Studies",
            //    column: "Name");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            //migrationBuilder.DropIndex(
            //    name: "IX_Studies_Name",
            //    table: "Studies");

            migrationBuilder.AlterColumn<string>(
                name: "LicenseType",
                table: "Studies",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(10)",
                oldMaxLength: 10);

            //migrationBuilder.CreateIndex(
            //    name: "IX_Studies_Id_Name",
            //    table: "Studies",
            //    columns: new[] { "Id", "Name" });
        }
    }
}
