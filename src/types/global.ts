import { User as DBUser } from '../db/schemas/usersAndOrganiser';
import { DBType } from '../db';

export {};

declare global {
	namespace Express {
		export interface Request {
			activeUser?: DBUser;
		}
	}

	var drizzleDb: DBType | null;
}
