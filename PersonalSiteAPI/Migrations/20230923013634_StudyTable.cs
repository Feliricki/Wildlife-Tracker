using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PersonalSiteAPI.Migrations
{
    public partial class StudyTable : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Studies",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Acknowledgements = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Citation = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    GoPublicDate = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    GrantsUsed = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IAmOwner = table.Column<bool>(type: "bit", nullable: false),
                    IsTest = table.Column<bool>(type: "bit", nullable: false),
                    LicenseTerms = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    MainLocationLat = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    MainLocationLon = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    NumberOfDeployments = table.Column<int>(type: "int", nullable: false),
                    NumberOfIndividuals = table.Column<int>(type: "int", nullable: false),
                    NumberOfTags = table.Column<int>(type: "int", nullable: false),
                    PrincipalInvestigatorAddress = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PrincipalInvestigatorEmail = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PricipalInvestigatorName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    StudyObjective = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    StudyType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SuspendLicenseTerms = table.Column<bool>(type: "bit", nullable: false),
                    ICanSeeData = table.Column<bool>(type: "bit", nullable: false),
                    ThereAreDataWhichICannotSee = table.Column<bool>(type: "bit", nullable: false),
                    IHaveDownloadAccess = table.Column<bool>(type: "bit", nullable: false),
                    IAmCollaborator = table.Column<bool>(type: "bit", nullable: false),
                    StudyPermission = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TimeStampFirstDeployedLocation = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TimeStampLastDeployedLocation = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    NumberOfDeployedLocations = table.Column<int>(type: "int", nullable: false),
                    TaxonIds = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SensorTypeIds = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ContactPersonName = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Studies", x => x.Id);
                });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Studies");
        }
    }
}
