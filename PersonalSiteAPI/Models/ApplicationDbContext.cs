using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace PersonalSiteAPI.Models
{
    public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
    {

        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.Entity<Studies>().HasKey(o =>  o.Id);

            //modelBuilder.Entity<RequestPermission>().HasKey(o => o.Id);
        }
        public DbSet<Studies> Studies => Set<Studies>();
        public DbSet<RequestPermission> RequestPermission => Set<RequestPermission>();
    }
}
