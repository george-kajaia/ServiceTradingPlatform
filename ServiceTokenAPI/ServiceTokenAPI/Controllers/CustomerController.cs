using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ServiceTokenApi.DBContext;
using ServiceTokenApi.Dto;
using ServiceTokenApi.Entities;
using System.Net.Mime;

namespace ServiceTokenApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces(MediaTypeNames.Application.Json)]
public class CustomerController(ServiceTokenDbContext db) : ControllerBase
{
    [HttpGet("GetAll")]
    public async Task<ActionResult<IEnumerable<Customer>>> GetAll(
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        [FromQuery] string? search = null)
    {
        take = Math.Clamp(take, 1, 200);

        var q = db.Customers.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            q = q.Where(c => EF.Functions.ILike(c.PublicKey, $"%{s}%")
                           || EF.Functions.ILike(c.UserName, $"%{s}%"));
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
    public async Task<ActionResult<Customer>> GetById(int id)
    {
        var c = await db.Customers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (c is null) return NotFound();

        return Ok(c);
    }

    [HttpPost("Login")]
    public async Task<ActionResult<Customer>> Login([FromBody] LoginCredentialDto loginCredential)
    {
        var c = await db.Customers.AsNoTracking().FirstOrDefaultAsync(x => x.UserName == loginCredential.UserName && x.Password == loginCredential.Password);
        if (c is null)
        {
            return NotFound();
        }

        return Ok(c);
    }

    [HttpPost("create")]
    public async Task<ActionResult<Customer>> Create([FromBody] Customer customer)
    {
        if (string.IsNullOrWhiteSpace(customer.Password))
            return BadRequest("Password is required.");

        // hash password
        var hash = customer.Password; // BCrypt.Net.BCrypt.HashPassword(customer.Password, workFactor: 12);

        var c = new Customer
        {
            PublicKey = customer.PublicKey.Trim(),
            UserName = customer.UserName.Trim(),
            Password = hash
        };

        db.Customers.Add(c);
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException?.Message.Contains("duplicate") == true)
        {
            return Conflict("UserName (or another unique field) already exists.");
        }

        return Ok(customer);
    }

    [HttpPut("update")]
    public async Task<ActionResult<Customer>> Update(int customerId, uint rowVersion, [FromBody] Customer customer)
    {
        var c = await db.Customers.FirstOrDefaultAsync(x => x.Id == customerId && x.RowVersion == rowVersion);
        if (c is null) return NotFound("The record was changed by another user. Refresh the Data.");

        db.Entry(c).Property(x => x.RowVersion).OriginalValue = rowVersion;

        c.Status = 0;
        c.PublicKey = customer.PublicKey.Trim();
        c.UserName = customer.UserName.Trim();

        if (!string.IsNullOrWhiteSpace(customer.Password))
        {
            c.Password = customer.Password; // BCrypt.Net.BCrypt.HashPassword(customer.Password, workFactor: 12);
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
    public async Task<IActionResult> Approve(int customerId, uint rowVersion)
    {
        var c = await db.Customers.FirstOrDefaultAsync(x => x.Id == customerId && x.RowVersion == rowVersion);
        if (c is null) return NotFound("The record was changed by another user. Refresh the Data.");

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
    public async Task<IActionResult> Delete(int customerId, uint rowVersion)
    {
        var c = await db.Customers.FirstOrDefaultAsync(x => x.Id == customerId && x.RowVersion == rowVersion);
        if (c is null) return NotFound("Record not found or already deleted.");

        db.Entry(c).Property(x => x.RowVersion).OriginalValue = rowVersion;

        db.Customers.Remove(c);

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

    // ── Saved payment method (one-to-one). The card token is captured automatically when a
    //    payment completes (see PaymentController). These endpoints never expose the raw token. ──

    [HttpGet("GetPaymentMethod/{customerId}")]
    public async Task<ActionResult<CustomerPaymentMethodDto>> GetPaymentMethod(long customerId)
    {
        var m = await db.CustomerPaymentMethods.AsNoTracking()
            .FirstOrDefaultAsync(x => x.CustomerId == customerId);

        if (m is null || string.IsNullOrWhiteSpace(m.CardToken) && string.IsNullOrWhiteSpace(m.Iban))
            return Ok(new CustomerPaymentMethodDto { HasSavedCard = false });

        return Ok(new CustomerPaymentMethodDto
        {
            HasSavedCard = !string.IsNullOrWhiteSpace(m.CardToken),
            MaskedCard = m.MaskedCard,
            CardType = m.CardType,
            PaymentSystem = m.PaymentSystem,
            TokenLifetime = m.TokenLifetime,
            Iban = m.Iban
        });
    }

    [HttpDelete("DeletePaymentMethod")]
    public async Task<IActionResult> DeletePaymentMethod(long customerId)
    {
        var m = await db.CustomerPaymentMethods.FirstOrDefaultAsync(x => x.CustomerId == customerId);
        if (m is null) return NoContent();

        db.CustomerPaymentMethods.Remove(m);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
