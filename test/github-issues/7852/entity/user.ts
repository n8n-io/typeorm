import { Entity, PrimaryColumn, ManyToMany, JoinTable } from "../../../../src"
import { UsersObject } from "./usersObject"

@Entity("User")
export class User {
    @PrimaryColumn({ type: "bytea" })
    id!: Buffer

    @ManyToMany(() => UsersObject, (obj: UsersObject) => obj.id, {
        cascade: false,
    })
    @JoinTable()
    objects!: UsersObject[]
}
