import { mysql } from "./generate/mysql"
import { postgres } from "./generate/postgres"
import { sqlite } from "./generate/sqlite"

export const resultsTemplates: Record<string, Record<string, string>> = {
    mysql,
    mariadb: mysql,
    sqlite,
    "sqlite-pooled": sqlite,
    postgres,
}
