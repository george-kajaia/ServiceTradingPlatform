using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualBasic;
using ServiceTokenApi.DBContext;
using ServiceTokenApi.Dto;
using ServiceTokenApi.Entities;
using ServiceTokenApi.Enums;
using System.Net;
using System.Net.Mime;
using System.Numerics;
using System.Xml.Linq;

namespace ServiceTokenApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces(MediaTypeNames.Application.Json)]
public class CompanyController(ServiceTokenDbContext db) : ControllerBase
{
    [HttpGet("GetAll")]
    public async Task<ActionResult<IEnumerable<Company>>> GetAll(
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        [FromQuery] string? search = null)
    {
        take = Math.Clamp(take, 1, 200);

        var q = db.Companies.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            q = q.Where(c => EF.Functions.ILike(c.Name, $"%{s}%")
                           || EF.Functions.ILike(c.TaxCode, $"%{s}%"));
        }

        var items = await q
            .OrderBy(c => c.Id)
            .Skip(skip)
            .Take(take)
            .Select(item => item)
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("GetById/{id}")]
    public async Task<ActionResult<Company>> GetById(int id)
    {
        var c = await db.Companies
            .AsNoTracking()
            .Include(x => x.BankAccount)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (c is null) return NotFound();

        return Ok(c);
    }

    [HttpPost("create")]
    public async Task<ActionResult<Company>> Create([FromBody] CompanyRequestDto Company)
    {
        if (string.IsNullOrWhiteSpace(Company.Password))
            return BadRequest("Password is required.");

        // hash password
        var hash = Company.Password; // BCrypt.Net.BCrypt.HashPassword(Company.Password, workFactor: 12);

        var company = new Company
        {
            Status = 0,
            RegDate = DateTime.UtcNow,

            Name = Company.Name.Trim(),
            TaxCode = Company.TaxCode.Trim(),
            Address = Company.Address.Trim(),
            LegalForm = Company.LegalForm,
            EconomicActivity = Company.EconomicActivity,
            Mail = Company.Mail.Trim(),
            Phone = Company.Phone.Trim(),

            Users = new List<CompanyUser>
            {
                new CompanyUser
                {
                    UserName = Company.UserName,
                    Password = hash,
                    UserType = CompanyUserType.Admin
                }
            }
        };

        // Attach the payout bank account (one-to-one) if any IBAN was supplied.
        if (!string.IsNullOrWhiteSpace(Company.BankAccountIban))
        {
            company.BankAccount = new CompanyBankAccount
            {
                Iban = Company.BankAccountIban.Trim(),
                BeneficiaryName = (Company.BankAccountName ?? string.Empty).Trim(),
                BankName = (Company.BankName ?? string.Empty).Trim()
            };
        }

        db.Companies.Add(company);
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException?.Message.Contains("duplicate") == true)
        {
            return Conflict("UserName (or another unique field) already exists.");
        }

        return Ok(Company);
    }

    [HttpPut("update")]
    public async Task<ActionResult<Company>> Update(int companyId, uint rowVersion, [FromBody] CompanyRequestDto Company)
    {
        var c = await db.Companies
            .Include(x => x.BankAccount)
            .FirstOrDefaultAsync(x => x.Id == companyId && x.RowVersion == rowVersion);
        if (c is null) return NotFound("The record was changed by another user. Refresh the data.");

        db.Entry(c).Property(x => x.RowVersion).OriginalValue = rowVersion;

        c.Name = Company.Name.Trim();
        c.TaxCode = Company.TaxCode.Trim();
        c.Address = Company.Address.Trim();
        c.LegalForm = Company.LegalForm;
        c.EconomicActivity = Company.EconomicActivity;
        c.Mail = Company.Mail.Trim();
        c.Phone = Company.Phone.Trim();

        // Upsert the payout bank account (one-to-one).
        var iban = (Company.BankAccountIban ?? string.Empty).Trim();
        if (!string.IsNullOrWhiteSpace(iban))
        {
            if (c.BankAccount is null)
            {
                c.BankAccount = new CompanyBankAccount
                {
                    CompanyId = c.Id,
                    Iban = iban,
                    BeneficiaryName = (Company.BankAccountName ?? string.Empty).Trim(),
                    BankName = (Company.BankName ?? string.Empty).Trim()
                };
            }
            else
            {
                c.BankAccount.Iban = iban;
                c.BankAccount.BeneficiaryName = (Company.BankAccountName ?? string.Empty).Trim();
                c.BankAccount.BankName = (Company.BankName ?? string.Empty).Trim();
            }
        }
        else if (c.BankAccount is not null)
        {
            // Cleared on the form → remove the stored account.
            db.CompanyBankAccounts.Remove(c.BankAccount);
            c.BankAccount = null;
        }

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict("The record was changed by another user. Refresh the data.");
        }
        catch (DbUpdateException ex) when (ex.InnerException?.Message.Contains("duplicate") == true)
        {
            return Conflict("UserName (or another unique field) already exists.");
        }

        return Ok(c);
    }

    [HttpPatch("Approve")]
    public async Task<IActionResult> Approve(int companyId, uint rowVersion)
    {
        var c = await db.Companies.FirstOrDefaultAsync(x => x.Id == companyId && x.RowVersion == rowVersion);
        if (c is null) return NotFound("The record was changed by another user. Refresh the data.");

        db.Entry(c).Property(x => x.RowVersion).OriginalValue = rowVersion;

        c.Status = 1;

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict("The record was changed by another user. Refresh the data.");
        }

        return Ok();
    }

    [HttpDelete("delete")]
    public async Task<IActionResult> Delete(int companyId, uint rowVersion)
    {
        var c = await db.Companies.FirstOrDefaultAsync(x => x.Id == companyId && x.RowVersion == rowVersion);
        if (c is null) return NotFound("Record not found or already deleted.");

        db.Entry(c).Property(x => x.RowVersion).OriginalValue = rowVersion;

        db.Companies.Remove(c);

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict("Record not found or already deleted.");
        }

        return NoContent();
    }

//User Methods------------------------------------------------------------------------------------------------------------------

    [HttpPost("AdminLogin")]
    public async Task<ActionResult<CompanyUser>> AdminLogin([FromBody] LoginCredentialDto loginCredential)
    {
        var c = await db.CompanyUsers.AsNoTracking().FirstOrDefaultAsync(x => x.UserName == loginCredential.UserName && x.Password == loginCredential.Password && x.UserType == CompanyUserType.Admin);
        if (c is null)
        {
            return NotFound();
        }

        return Ok(c);
    }

    [HttpPost("Login")]
    public async Task<ActionResult<CompanyUser>> Login([FromBody] LoginCredentialDto loginCredential)
    {
        var c = await db.CompanyUsers.AsNoTracking().FirstOrDefaultAsync(x => x.UserName == loginCredential.UserName && x.Password == loginCredential.Password && x.UserType == CompanyUserType.Other);
        if (c is null)
        {
            return NotFound();
        }

        return Ok(c);
    }

    [HttpGet("GetAllUsers")]
    public async Task<ActionResult<IEnumerable<Product>>> GetAllUsers(
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        [FromQuery] string? search = null)
    {
        take = Math.Clamp(take, 1, 200);

        var q = db.CompanyUsers.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            q = q.Where(c => EF.Functions.ILike(c.UserName, $"%{s}%"));
        }

        var items = await q
            .OrderBy(c => c.Id)
            .Skip(skip)
            .Take(take)
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("GetUserByName/{userName}")]
    public async Task<IActionResult> GetUserByName(string userName)
    {
        var product = await db.CompanyUsers.FirstOrDefaultAsync(x => x.UserName == userName);
        if (product is null) return NotFound();

        return Ok(product);
    }

    [HttpPost("CreateUser")]
    public async Task<IActionResult> CreateUser([FromBody] CompanyUserRequestDto user)
    {
        if (string.IsNullOrWhiteSpace(user.UserName))
            return BadRequest("User name is required.");

        if (string.IsNullOrWhiteSpace(user.Password))
            return BadRequest("Password is required.");

        // hash password
        var hash = user.Password; // BCrypt.Net.BCrypt.HashPassword(Company.Password, workFactor: 12);

        var companyUser = new CompanyUser
        {
            UserType = user.UserType,
            CompanyId = user.CompanyId,
            UserName = user.UserName,
            Password = user.Password
        };

        db.CompanyUsers.Add(companyUser);
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException?.Message.Contains("duplicate") == true)
        {
            return Conflict("UserName (or another unique field) already exists.");
        }

        return Ok();
    }

    [HttpPut("UpdateUser")]
    public async Task<IActionResult> UpdateUser([FromBody] CompanyUserRequestDto user)
    {
        if (string.IsNullOrWhiteSpace(user.UserName))
            return BadRequest("User name is required.");

        if (string.IsNullOrWhiteSpace(user.Password))
            return BadRequest("Password is required.");

        // hash password
        var hash = user.Password; // BCrypt.Net.BCrypt.HashPassword(Company.Password, workFactor: 12);

        var companyUser = new CompanyUser
        {
            UserType = user.UserType,
            CompanyId = user.CompanyId,
            UserName = user.UserName,
            Password = user.Password
        };

        db.CompanyUsers.Update(companyUser);
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException?.Message.Contains("duplicate") == true)
        {
            return Conflict("UserName (or another unique field) already exists.");
        }

        return Ok();
    }

    [HttpDelete("DeleteUser")]
    public async Task<IActionResult> DeleteUser([FromBody] long companyId, string userName)
    {
        if (companyId <= 0 )
            return BadRequest("Company Id is required.");

        if (string.IsNullOrWhiteSpace(userName))
            return BadRequest("Password is required.");

        var c = await db.CompanyUsers.FirstOrDefaultAsync(x => x.CompanyId == companyId && x.UserName == userName);
        if (c is null) return NotFound("Record not found or already deleted.");

        db.CompanyUsers.Remove(c);

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict("Record not found or already deleted.");
        }

        return NoContent();
    }

}