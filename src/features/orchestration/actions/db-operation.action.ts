import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ActionHandler, WorkflowExecutionContext } from '../types/workflow.types';

@Injectable()
export class DbOperationAction implements ActionHandler {
  readonly type = 'db_operation';

  constructor(private readonly prisma: PrismaService) {}

  async execute(params: any, context: WorkflowExecutionContext): Promise<any> {
    const { operation, table, data, where } = params;

    // Dynamic access to Prisma models
    const model = (this.prisma as any)[table];

    if (!model) {
      throw new Error(`Invalid table: ${table}`);
    }

    switch (operation) {
      case 'create':
        return model.create({ data });

      case 'update':
        return model.update({ where, data });

      case 'findFirst':
        return model.findFirst({ where });

      case 'findMany':
        return model.findMany({ where });

      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  }
}
