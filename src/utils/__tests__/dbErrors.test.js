import { describe, it, expect } from 'vitest';
import { describeRouteError } from '../dbErrors';

describe('describeRouteError', () => {
  it('points to the migration when the route columns or table are missing', () => {
    const missingColumn = describeRouteError({ code: '42703', message: 'column customers.route_order does not exist' });
    expect(missingColumn).toContain('supabase_customer_routes.sql');

    const missingTable = describeRouteError({ code: 'PGRST205', message: "Could not find the table 'public.customer_visits' in the schema cache" });
    expect(missingTable).toContain('supabase_customer_routes.sql');

    const schemaCache = describeRouteError({ code: 'PGRST204', message: "Could not find the 'lat' column of 'customers' in the schema cache" });
    expect(schemaCache).toContain('supabase_customer_routes.sql');
  });

  it('explains a row-level-security rejection as a permission problem', () => {
    const message = describeRouteError({ code: '42501', message: 'new row violates row-level security policy for table "customer_visits"' });
    expect(message).toMatch(/izin/i);
  });

  it('falls back to the raw message for other errors', () => {
    expect(describeRouteError({ message: 'network down' })).toBe('network down');
  });
});
