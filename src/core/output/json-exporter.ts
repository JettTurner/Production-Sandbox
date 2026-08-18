import { ProductionModel } from "../models/production-model.js";
import { CompletenessReport } from "../production/completeness.js";

export interface ExportData {
  productionModel: ProductionModel;
  completeness: CompletenessReport;
  exportedAt: string;
}

export class JsonExporter {
  static export(model: ProductionModel, completeness: CompletenessReport): string {
    const data: ExportData = {
      productionModel: model,
      completeness,
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(data, null, 2);
  }

  static exportModel(model: ProductionModel): string {
    return JSON.stringify(model, null, 2);
  }
}
