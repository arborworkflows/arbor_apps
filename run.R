#!/usr/bin/env Rscript

args <- commandArgs(trailingOnly = TRUE)

if (length(args) == 0) {
  system("cat tasks.json")
  quit()
}

library(ape)
library(aRbor)

if (args[1] == "phylogenetic_signal") {
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
}

if (args[1] == "ancestral_state") {
  tree <- read.tree(args[2])
  table <- read.csv(args[3], check.names = FALSE)
  column <- args[4]
  results_file <- args[5]
  plot_file <- args[6]

  method <- "marginal"

  td <- make.treedata(tree, table)
  td1 <- select_(td, as.name(column))
  dat <- td1$dat

  type <- aRbor:::detectCharacterType(dat[[1]], cutoff = 0.2)

  if (type == "continuous") td1 <- checkNumeric(td1)
  if (type == "discrete") td1 <- checkFactor(td1)

  output <- aceArbor(td1, charType = type, aceType = method)

  TH <- max(branching.times(td$phy))

  # make sure the image is large enough for labels
  size <- nrow(dat) * 15 + 200

  png(plot_file, width = size, height = size)
  plot(output, label.offset = 0.05 * TH)
  dev.off()

  res <- output[[1]]
  node_labels <- 1:td1$phy$Nnode + length(td1$phy$tip.label)
  res <- cbind(node_labels, res)
  write.csv(res, results_file)
}
