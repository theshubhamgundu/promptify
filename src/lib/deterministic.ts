export class DeterministicEvaluator {
  static evaluate(answer: string, expected: string, type: 'exact' | 'contains' | 'regex'): boolean {
    if (!answer || !expected) return false;
    
    const cleanAnswer = answer.trim().toLowerCase();
    const cleanExpected = expected.trim().toLowerCase();

    switch (type) {
      case 'exact':
        return cleanAnswer === cleanExpected;
      case 'contains':
        return cleanAnswer.includes(cleanExpected);
      case 'regex':
        try {
          const regex = new RegExp(expected, 'i');
          return regex.test(answer);
        } catch (e) {
          console.error("Invalid regex in expected output", e);
          return false;
        }
      default:
        return false;
    }
  }
}
