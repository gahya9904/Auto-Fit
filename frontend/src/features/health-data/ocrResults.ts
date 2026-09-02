import type { SelectedHealthFile } from './useHealthFilePicker';

export type OCRDocumentType = 'health_checkup' | 'inbody';

export interface HealthCheckupOCRResult {
  bloodPressure: string;
  bmi: string;
  checkupDate: string;
  fastingBloodSugar: string;
  height: string;
  hemoglobin: string;
  totalCholesterol: string;
  weight: string;
}

export interface InbodyOCRResult {
  basalMetabolicRate: string;
  bmi: string;
  bodyFatMass: string;
  bodyFatPercentage: string;
  height: string;
  measurementDate: string;
  skeletalMuscleMass: string;
  visceralFatLevel: string;
  weight: string;
}

interface OCRResultBase {
  fileMimeType?: string;
  fileName: string;
  fileSource: SelectedHealthFile['source'];
  id: string;
  previewUri?: string;
  uploadedAt?: string;
}

export type OCRResultItem =
  | (OCRResultBase & {
      data: HealthCheckupOCRResult;
      type: 'health_checkup';
    })
  | (OCRResultBase & {
      data: InbodyOCRResult;
      type: 'inbody';
    });

const mockHealthCheckupData: HealthCheckupOCRResult = {
  bloodPressure: '120 / 80',
  bmi: '22.3',
  checkupDate: '2026.08.01',
  fastingBloodSugar: '92',
  height: '175.2',
  hemoglobin: '14.2',
  totalCholesterol: '185',
  weight: '68.4',
};

const mockInbodyData: InbodyOCRResult = {
  basalMetabolicRate: '1520',
  bmi: '22.3',
  bodyFatMass: '14.2',
  bodyFatPercentage: '20.8',
  height: '175.2',
  measurementDate: '2026.08.01',
  skeletalMuscleMass: '30.8',
  visceralFatLevel: '6',
  weight: '68.4',
};

const defaultMockFile: SelectedHealthFile = {
  mimeType: 'application/pdf',
  name: '2026_건강검진결과표.pdf',
  source: 'document',
  uri: '',
};

export function createMockOCRResults(files: SelectedHealthFile[]): OCRResultItem[] {
  const sourceFiles = files.length > 0 ? files : [defaultMockFile];

  return sourceFiles.map((file, index) => {
    const common = {
      fileMimeType: file.mimeType,
      fileName: file.name,
      fileSource: file.source,
      id: `mock-ocr-${index + 1}`,
      previewUri: file.uri,
      uploadedAt: '2026. 08. 11 09:13',
    };

    // TODO: 실제 OCR/KIE API 응답의 type과 data로 이 mock 결과 생성을 교체합니다.
    if (index % 2 === 1) {
      return {
        ...common,
        data: { ...mockInbodyData },
        type: 'inbody',
      };
    }

    return {
      ...common,
      data: { ...mockHealthCheckupData },
      type: 'health_checkup',
    };
  });
}
