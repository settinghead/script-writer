# Set OpenAI API Key to the environment variable. You can also pass the token to dspy.LM()
import getpass
import os
from dotenv import dotenv_values

config = dotenv_values(".env") 

LLM_API_KEY=config["LLM_API_KEY"]
LLM_BASE_URL=config["LLM_BASE_URL"]
LLM_MODEL_NAME=config["LLM_MODEL_NAME"]

import dspy

# For custom OpenAI-compatible APIs, use the openai/ prefix
lm = dspy.LM(
  model=f"openai/{LLM_MODEL_NAME}",  # Add openai/ prefix for custom APIs
  api_key=LLM_API_KEY,
  api_base=LLM_BASE_URL,
  max_tokens=500,
  temperature=0.1,
)
dspy.settings.configure(lm=lm)

import mlflow

mlflow.set_experiment("DSPy Quickstart")

mlflow.dspy.autolog()



from dataset import csv_train_dataset, csv_test_dataset, unique_csv_train_labels

class TextClassificationSignature(dspy.Signature):
  text = dspy.InputField()
  label = dspy.OutputField(
      desc=f"Label of predicted class. Possible labels are {unique_csv_train_labels}"
  )


class TextClassifier(dspy.Module):
  def __init__(self):
      super().__init__()
      self.generate_classification = dspy.Predict(TextClassificationSignature)

  def forward(self, text: str):
      return self.generate_classification(text=text)

from copy import copy

# Initilize our impact_improvement class
text_classifier = copy(TextClassifier())

message = "I am interested in space"
print(text_classifier(text=message))

message = "I enjoy ice skating"
print(text_classifier(text=message))

from dspy.teleprompt import BootstrapFewShotWithRandomSearch


def validate_classification(example, prediction, trace=None) -> bool:
  return example.label == prediction.label


optimizer = BootstrapFewShotWithRandomSearch(
  metric=validate_classification,
  num_candidate_programs=5,
  max_bootstrapped_demos=2,
  num_threads=1,
)

compiled_pe = optimizer.compile(copy(TextClassifier()), trainset=train_dataset)