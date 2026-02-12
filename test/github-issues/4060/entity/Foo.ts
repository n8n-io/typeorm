import { Column, Entity, PrimaryColumn } from "../../../../src"

@Entity()
export class Foo {
    @PrimaryColumn({ type: "bytea" })
    id: Buffer

    @Column()
    name: string
}
