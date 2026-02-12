import {
    Column,
    Entity,
    JoinColumn,
    OneToOne,
    PrimaryColumn,
} from "../../../../src"
import { Foo } from "./Foo"

@Entity()
export class Bar {
    @PrimaryColumn({ type: "bytea" })
    id: Buffer

    @Column()
    name: string

    @OneToOne(() => Foo)
    @JoinColumn({ name: "id", referencedColumnName: "id" })
    foo: Foo
}
