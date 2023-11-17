using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PersonalSiteAPI.Migrations
{
    /// <inheritdoc />
    public partial class RequestPermissionTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RequestPermission",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Acknowledgements = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Citation = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    LicenseTerms = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    LicenseType = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    MainLocationLat = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    MainLocationLon = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PrincipalInvestigatorAddress = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PrincipalInvestigatorEmail = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PrincipalInvestigatorName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ThereAreDataWhichICannotSee = table.Column<bool>(type: "bit", nullable: false),
                    IHaveDownloadAccess = table.Column<bool>(type: "bit", nullable: false),
                    IAmCollaborator = table.Column<bool>(type: "bit", nullable: false),
                    StudyPermission = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ContactPersonName = table.Column<string>(type: "nvarchar(450)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RequestPermission", x => x.Id);
                });
            // Index this table by Contact Name which is also their movebank username 
            migrationBuilder.CreateIndex(
                name: "IX_RequestPermission_ContactPersonName",
                table: "RequestPermission",
                column: "ContactPersonName");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RequestPermission");
        }
    }
}
