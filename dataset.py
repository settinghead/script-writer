import numpy as np
import pandas as pd
from dspy.datasets.dataset import Dataset

def read_data_and_subset_to_categories() -> tuple[pd.DataFrame]:
  """
  Read the reuters-21578 dataset. Docs can be found in the url below:
  https://huggingface.co/datasets/yangwang825/reuters-21578
  """

  # Read train/test split
  file_path = "hf://datasets/yangwang825/reuters-21578/{}.json"
  train = pd.read_json(file_path.format("train"))
  test = pd.read_json(file_path.format("test"))

  # Clean the labels
  label_map = {
      0: "acq",
      1: "crude",
      2: "earn",
      3: "grain",
      4: "interest",
      5: "money-fx",
      6: "ship",
      7: "trade",
  }

  train["label"] = train["label"].map(label_map)
  test["label"] = test["label"].map(label_map)

  return train, test


class CSVDataset(Dataset):
  def __init__(
      self, n_train_per_label: int = 20, n_test_per_label: int = 10, *args, **kwargs
  ) -> None:
      super().__init__(*args, **kwargs)
      self.n_train_per_label = n_train_per_label
      self.n_test_per_label = n_test_per_label

      self._create_train_test_split_and_ensure_labels()

  def _create_train_test_split_and_ensure_labels(self) -> None:
      """Perform a train/test split that ensure labels in `dev` are also in `train`."""
      # Read the data
      train_df, test_df = read_data_and_subset_to_categories()

      # Sample for each label
      train_samples_df = pd.concat(
          [group.sample(n=self.n_train_per_label) for _, group in train_df.groupby("label")]
      )
      test_samples_df = pd.concat(
          [group.sample(n=self.n_test_per_label) for _, group in test_df.groupby("label")]
      )

      # Set DSPy class variables
      self._train = train_samples_df.to_dict(orient="records")
      self._dev = test_samples_df.to_dict(orient="records")


# Limit to a small dataset to showcase the value of bootstrapping
csv_dataset = CSVDataset(n_train_per_label=3, n_test_per_label=1)

# Create train and test sets containing DSPy
# Note that we must specify the expected input value name
csv_train_dataset = [example.with_inputs("text") for example in csv_dataset.train]
csv_test_dataset = [example.with_inputs("text") for example in csv_dataset.dev]
unique_csv_train_labels = {example.label for example in csv_dataset.train}

if __name__ == "__main__":
    print(len(csv_train_dataset), len(csv_test_dataset))
    print(f"Train labels: {unique_csv_train_labels}")
    print(csv_train_dataset[0])