using ServiceTokenApi.Enums;

namespace ServiceTokenApi.Dto
{
    public class CompanyUserRequestDto
    {
        public CompanyUserType UserType { get; set; }
        public long CompanyId { get; set; }
        public string UserName { get; set; } = string.Empty;
        
        public string Password { get; set; } = string.Empty;
    }
}
