#!/usr/bin/env Rscript

args <- commandArgs(trailingOnly = TRUE)

if (length(args) == 0) {
  system("cat tasks.json")
  exit()
}

library(ape)
library(aRbor)

method <- "lambda"

tree <- read.tree(args[2])
table <- read.csv(args[3], check.names = FALSE)
column <- args[4]
output_file <- args[5]

td <- make.treedata(tree, table)
td <- select_(td, as.name(column))
phy <- td$phy
dat <- td$dat

char_type <- aRbor:::detectCharacterType(dat[[1]], cutoff = 0.2)

if (char_type == "discrete") {
  result <- physigArbor(td, charType = char_type, signalTest = "pagelLambda")
}
if (char_type == "continuous") {
  if (method == "lambda") {
    result <- physigArbor(td, charType = char_type, signalTest = "pagelLambda")
  }
  if (method == "K") {
    result <- physigArbor(td, charType = char_type, signalTest = "Blomberg")
  }
}

result <- t(as.data.frame(unlist(result)))
rownames(result) <- NULL

print(result)

write.csv(result, output_file)
