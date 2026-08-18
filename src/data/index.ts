import { Question } from "../core/models/questions.js";
import { workQuestions } from "./work.js";
import { peopleQuestions } from "./people.js";
import { relationshipQuestions } from "./relationships.js";
import { flowQuestions } from "./flow.js";
import { informationQuestions } from "./information.js";
import { timeScaleQuestions } from "./time-scale.js";
import { exceptionQuestions } from "./exceptions.js";

export const allQuestions: Question[] = [
  ...workQuestions,
  ...peopleQuestions,
  ...relationshipQuestions,
  ...flowQuestions,
  ...informationQuestions,
  ...timeScaleQuestions,
  ...exceptionQuestions,
];

export function getQuestionById(id: string): Question | undefined {
  return allQuestions.find(q => q.id === id);
}
