import "dotenv/config";
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../generated/prisma/client'

// Use a sanitized connection string to avoid passing an empty password token
// (e.g. "postgresql://postgres:@..."), which can cause `pg`/SCRAM auth errors.
let connectionString = process.env.DATABASE_URL ?? '';

if (!connectionString) {
	throw new Error('DATABASE_URL is not set. Please set it in your .env or environment variables.');
}

// If the connection string contains an empty password like `postgres:@`, convert it to
// `postgres@` to avoid sending an empty password token to pg.
// Example: postgresql://postgres:@localhost:5432/DB -> postgresql://postgres@localhost:5432/DB
if (/:[^:@\/]*@/.test(connectionString)) {
	// Find the username:password part
	const userPassMatch = connectionString.match(/^(.*:\/\/)([^:@\/]+):([^@\/]*)(@.*)$/);
	if (userPassMatch) {
		const [, scheme, username, password, rest] = userPassMatch;
		if (password === '') {
			connectionString = `${scheme}${username}${rest}`;
			console.warn('Sanitized DATABASE_URL to remove empty password token.');
		}
	}
}

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

export { prisma }