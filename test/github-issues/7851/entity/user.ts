import { Entity, PrimaryColumn } from "../../../../src"

@Entity("User")
export class User {
    @PrimaryColumn({ type: "bytea" })
    id!: Buffer
}
