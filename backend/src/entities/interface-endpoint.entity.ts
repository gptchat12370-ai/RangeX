import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'interface_endpoint' })
export class InterfaceEndpoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 160 })
  label: string;

  @Column({ length: 64 })
  type: string; // vpn, gateway, sg, vpc-endpoint

  @Column({ type: 'varchar', length: 255 })
  value: string; // e.g., CIDR, endpoint ID, URL

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
