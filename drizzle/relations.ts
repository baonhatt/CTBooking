import { relations } from "drizzle-orm/relations";
import { users, accounts, movies, bookings, ticketPackages, tokens } from "./schema";

export const accountsRelations = relations(accounts, ({one, many}) => ({
	user: one(users, {
		fields: [accounts.userId],
		references: [users.id]
	}),
	tokens: many(tokens),
}));

export const usersRelations = relations(users, ({many}) => ({
	accounts: many(accounts),
	bookings: many(bookings),
}));

export const bookingsRelations = relations(bookings, ({one}) => ({
	movie: one(movies, {
		fields: [bookings.movieId],
		references: [movies.id]
	}),
	ticketPackage: one(ticketPackages, {
		fields: [bookings.ticketPackageId],
		references: [ticketPackages.id]
	}),
	user: one(users, {
		fields: [bookings.userId],
		references: [users.id]
	}),
}));

export const moviesRelations = relations(movies, ({many}) => ({
	bookings: many(bookings),
}));

export const ticketPackagesRelations = relations(ticketPackages, ({many}) => ({
	bookings: many(bookings),
}));

export const tokensRelations = relations(tokens, ({one}) => ({
	account: one(accounts, {
		fields: [tokens.accountId],
		references: [accounts.id]
	}),
}));