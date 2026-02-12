import { Column, Entity, PrimaryGeneratedColumn } from "../../../../src"

@Entity("test")
export class Test {
    @PrimaryGeneratedColumn()
    id: number

    @Column({ type: "timestamp", nullable: true, default: null })
    publish_date: Date
}
