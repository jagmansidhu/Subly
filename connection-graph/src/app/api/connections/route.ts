import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, executeInsert } from '@/lib/snowflake';

// GET - Fetch all connections from Snowflake
export async function GET() {
    try {
        const rows = await executeQuery(`SELECT * FROM CONNECTIONS ORDER BY CREATED_AT DESC`);

        // Transform Snowflake rows to frontend format
        const connections = rows.map(row => ({
            id: row.ID as string,
            name: row.NAME as string,
            title: (row.TITLE as string) || 'Unknown',
            company: (row.COMPANY as string) || 'Unknown',
            industry: (row.INDUSTRY as string) || 'Other',
            email: row.EMAIL || undefined,
            phone: row.PHONE || undefined,
            linkedIn: row.LINKEDIN || undefined,
            lastContactDate: row.LAST_CONTACT_DATE ? new Date(row.LAST_CONTACT_DATE as string).toISOString() : new Date().toISOString(),
            degree: (row.DEGREE as number) || 1,
            connectedThrough: row.CONNECTED_THROUGH || undefined,
            notes: row.NOTES || undefined,
        }));

        return NextResponse.json({ connections });
    } catch (error) {
        console.error('Error fetching connections:', error);
        return NextResponse.json(
            { error: 'Failed to fetch connections', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

// POST - Insert new connection(s) to Snowflake
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const connections = Array.isArray(body) ? body : [body];

        for (const conn of connections) {
            // Escape single quotes in strings
            const escape = (val: unknown) => val ? String(val).replace(/'/g, "''") : null;

            const sql = `
                INSERT INTO CONNECTIONS (ID, NAME, TITLE, COMPANY, INDUSTRY, EMAIL, PHONE, LINKEDIN, LAST_CONTACT_DATE, DEGREE, CONNECTED_THROUGH, NOTES)
                VALUES (
                    '${escape(conn.id)}',
                    '${escape(conn.name)}',
                    ${conn.title ? `'${escape(conn.title)}'` : 'NULL'},
                    ${conn.company ? `'${escape(conn.company)}'` : 'NULL'},
                    '${escape(conn.industry) || 'Other'}',
                    ${conn.email ? `'${escape(conn.email)}'` : 'NULL'},
                    ${conn.phone ? `'${escape(conn.phone)}'` : 'NULL'},
                    ${conn.linkedIn ? `'${escape(conn.linkedIn)}'` : 'NULL'},
                    ${conn.lastContactDate ? `'${new Date(conn.lastContactDate).toISOString()}'` : 'NULL'},
                    ${conn.degree || 1},
                    ${conn.connectedThrough ? `'${escape(conn.connectedThrough)}'` : 'NULL'},
                    ${conn.notes ? `'${escape(conn.notes)}'` : 'NULL'}
                )
            `;

            await executeInsert(sql);
        }

        return NextResponse.json({ success: true, count: connections.length });
    } catch (error) {
        console.error('Error inserting connection:', error);
        return NextResponse.json(
            { error: 'Failed to save connection', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
