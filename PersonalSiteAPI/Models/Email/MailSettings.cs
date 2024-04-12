namespace PersonalSiteAPI.Models.Email
{
    public class MailSettings
    {
        public string? Server { get; set; }
        public int Port { get; set; } = default;
        public string? SenderName { get; set; }
        public string? SenderEmail { get; set; }
        public string? UserName { get; set; }
        public string? Password { get; set; }
    }
}
