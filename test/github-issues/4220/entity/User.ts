import { Entity, PrimaryColumn, Column } from "../../../../src"

@Entity()
export class User {
    @PrimaryColumn({
        comment: "The ID of this user.",
        type: "bytea",
    })
    id: Buffer

    @Column()
    name: string
}
