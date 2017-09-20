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

if (args[1] == 'pgls') {
  require(nlme)

  tree <- read.tree(args[2])
  table <- read.csv(args[3], check.names = TRUE)
  correlation <- args[4]
  ind_variable <- make.names(args[5])
  dep_variable <- make.names(args[6])
  modelfit_summary_file <- args[7]
  plot_file <- args[8]

  if (correlation == "BM"){
    cor <- corBrownian(1, phy = tree)
  }
  if (correlation == "OU"){
    cor <- corMartins(1, phy = tree, fixed = FALSE)
  }
  if (correlation == "Pagel"){
    cor <- corPagel(1, phy = tree, fixed = FALSE)
    cor1 <- corPagel(1, phy = tree, fixed = TRUE)
    cor0 <- corPagel(0, phy = tree, fixed = TRUE)
  }
  if (correlation == "ACDC"){
    cor <- corBlomberg(1, phy = tree, fixed = FALSE)
  }

  fmla <- as.formula(paste(as.character(dep_variable), ' ~ ', as.character(ind_variable), sep = ""))
  res <- gls(model = fmla, correlation = cor, data = table, control = glsControl(opt = "optim"))
  sum_res <- summary(res)
  sum_aov <- anova(res)

  parameter <- coef(summary(res))
  coefficients <- cbind(rownames(parameter), parameter)
  colnames(coefficients)[1] <- "parameter"

  if (correlation == "OU") {
    alpha <- res$modelStruct[[1]][[1]]
    coefficients <- rbind(coefficients, c("alpha", alpha, NA, NA, NA))
  }

  modelfit_summary <- data.frame(
    "AIC" = sum_res$AIC,
    loglik = sum_res$logLik,
    residual_SE = sum_res$sigma,
    df_total = sum_res$dims$N,
    df_residual = sum_res$dims$N - sum_res$dims$p)
  write.csv(modelfit_summary, modelfit_summary_file)

  png(plot_file, width = 1000, height = 1000)
  plot(table[, ind_variable], table[, dep_variable],
    pch = 21, bg = "gray80", xlab = ind_variable, ylab = dep_variable)
  abline(res, lty = 2, lwd = 2)
  dev.off()

}

if (args[1] == 'pic') {
  tree <- read.tree(args[2])
  table <- read.csv(args[3], check.names = TRUE)
  ind_variable <- make.names(args[4])
  dep_variable <- make.names(args[5])
  modelfit_summary_file <- args[6]
  pic_file <- args[7]

  td <- make.treedata(tree, table)

  # get x and y data with names
  # would be better to have an aRbor function that takes td directly?

  x <- select_(td, ind_variable)$dat[[1]]
  names(x) <- td$tree$tip.label

  y <- select_(td, dep_variable)$dat[[1]]
  names(y) <- td$tree$tip.label

  # calculate independent contrasts
  picX <- pic(x, tree)
  picY <- pic(y, tree)

  # run regression forced through the origin
  res <- lm(picY ~ picX - 1)
  output <- anova(res)

  # modelfit_summary is the model summary
  # coerce into table
  modelfit_summary <- cbind(c(dep_variable, "Residuals"), c(coefficients(res), NA), output[, 1:5])
  colnames(modelfit_summary)[1] <- "Effect"
  colnames(modelfit_summary)[2] <- "Slope"
  write.csv(modelfit_summary, modelfit_summary_file)

  # pic are the contrasts
  pic <- cbind(picX, picY)
  write.csv(pic, pic_file)
}
