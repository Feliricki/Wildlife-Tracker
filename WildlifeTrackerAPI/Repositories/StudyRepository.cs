using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using WildlifeTrackerAPI.Models;

namespace WildlifeTrackerAPI.Repositories
{
    public class StudyRepository : IStudyRepository
    {
        private readonly ApplicationDbContext _context;

        public StudyRepository(ApplicationDbContext context)
        {
            _context = context;
        }

        public IQueryable<Studies> GetStudiesQuery()
        {
            return _context.Studies.AsNoTracking();
        }

        public async Task<Studies?> GetStudyByIdAsync(long studyId)
        {
            return await _context.Studies
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == studyId);
        }
    }
}
