using MailKit.Net.Smtp;
using Microsoft.Extensions.Options;
using MimeKit;
using Newtonsoft.Json;
using PersonalSiteAPI.Models.Email;

namespace PersonalSiteAPI.Services
{
    public interface IEmailService
    {
        Task<bool> SendMailAsync(MailData mailData);
        Task<bool> SendMailToMeAsync(string email, string content);
    }
    public class EmailService : IEmailService   
    {
        private readonly MailSettings _mailSettings;
        private readonly MailRecipient _recipient;
        public EmailService(
            IOptions<MailSettings> mailSettingsOptions, IOptions<MailRecipient> recipient)
        {
            _mailSettings = mailSettingsOptions.Value;
            _recipient = recipient.Value;
        }

        public async Task<bool> SendMailToMeAsync(string email, string content)
        {
            try
            {
                Console.WriteLine(JsonConvert.SerializeObject(_mailSettings));
                Console.WriteLine(JsonConvert.SerializeObject(_recipient));
                using var emailMessage = new MimeMessage();
                MailboxAddress emailFrom = new MailboxAddress(_mailSettings.SenderName, _mailSettings.SenderEmail);
                emailMessage.From.Add(emailFrom);
                var emailTo = new MailboxAddress(_recipient.RecipientName, _recipient.RecipientEmail);
                emailMessage.To.Add(emailTo);
                emailMessage.Subject = $"Suggestion From User: {email}";

                //emailMessage.Cc.Add(new MailboxAddress("Cc Receiver", "cc@example.com"));
                //emailMessage.Bcc.Add(new MailboxAddress("Bcc Receiver", "bcc@example.com"));

                BodyBuilder emailBodyBuilder = new BodyBuilder();
                emailBodyBuilder.TextBody = content;

                emailMessage.Body = emailBodyBuilder.ToMessageBody();

                using SmtpClient mailClient = new SmtpClient();
                await mailClient.ConnectAsync(_mailSettings.Server, _mailSettings.Port, MailKit.Security.SecureSocketOptions.StartTls);
                await mailClient.AuthenticateAsync(_mailSettings.UserName, _mailSettings.Password);
                await mailClient.SendAsync(emailMessage);
                await mailClient.DisconnectAsync(true);

                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex);
                return false;
            }
            
        }

        public async Task<bool> SendMailAsync(MailData mailData)
        {
            try
            {
                Console.WriteLine(JsonConvert.SerializeObject(_mailSettings));
                using MimeMessage emailMessage = new MimeMessage();
                MailboxAddress emailFrom = new MailboxAddress(_mailSettings.SenderName, _mailSettings.SenderEmail);
                emailMessage.From.Add(emailFrom);
                MailboxAddress emailTo = new MailboxAddress(mailData.EmailToName, mailData.EmailToId);
                emailMessage.To.Add(emailTo);

                //emailMessage.Cc.Add(new MailboxAddress("Cc Receiver", "cc@example.com"));
                //emailMessage.Bcc.Add(new MailboxAddress("Bcc Receiver", "bcc@example.com"));

                emailMessage.Subject = mailData.EmailSubject;

                BodyBuilder emailBodyBuilder = new BodyBuilder();
                emailBodyBuilder.TextBody = mailData.EmailBody;

                emailMessage.Body = emailBodyBuilder.ToMessageBody();
                //this is the SmtpClient from the Mailkit.Net.Smtp namespace, not the System.Net.Mail one
                using SmtpClient mailClient = new SmtpClient();
                await mailClient.ConnectAsync(_mailSettings.Server, _mailSettings.Port, MailKit.Security.SecureSocketOptions.StartTls);
                await mailClient.AuthenticateAsync(_mailSettings.UserName, _mailSettings.Password);
                await mailClient.SendAsync(emailMessage);
                await mailClient.DisconnectAsync(true);

                return true;
            }
            catch (Exception ex)
            {
                // Exception Details
                Console.WriteLine(ex);
                return false;
            }
        }
    }
}
