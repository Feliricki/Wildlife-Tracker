using System.Linq;
using System.Threading.Tasks;
using WildlifeTrackerAPI.Models;

namespace WildlifeTrackerAPI.Repositories
{
    public interface IStudyRepository
    {
        IQueryable<Studies> GetStudiesQuery();
        Task<Studies?> GetStudyByIdAsync(long studyId);
    }
}
