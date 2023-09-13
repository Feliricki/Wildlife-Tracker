using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using PersonalSiteAPI.Models;

var builder = WebApplication.CreateBuilder(args);

Console.WriteLine("Starting backend configurations");

// Add services to the container.

builder.Services.AddHealthChecks();
builder.Services.AddControllers();

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHttpContextAccessor();

builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    //Console.WriteLine(builder.Configuration.GetConnectionString("DefaultConnection"));
    //Console.WriteLine(builder.Configuration["TestConnectionStrings:DefaultConnection"]);
    options.UseSqlServer(

        builder.Configuration.GetConnectionString("DefaultConnection")
    ); 
});

builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.Password.RequireDigit = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireUppercase = true;
    options.Password.RequireNonAlphanumeric = true;
    options.Password.RequiredLength = 12;
})
    .AddEntityFrameworkStores<ApplicationDbContext>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseAuthorization();

// When it comes to mapping controllers its first come first serve  
//app.UseHealthChecks(new PathString("/api/health"));
app.MapControllers();

app.Run();
