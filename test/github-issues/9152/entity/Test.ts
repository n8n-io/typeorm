import { Column, Entity, PrimaryGeneratedColumn } from "../../../../src"

export type ValueUnion = 1 | 2 | 3

@Entity()
export class Test {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    value: ValueUnion
}
