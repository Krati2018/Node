/*
MySQL - 5.7.10-log : Database - xaas_bot
*********************************************************************
*/


/*!40101 SET NAMES utf8 */;

/*!40101 SET SQL_MODE=''*/;

/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
CREATE DATABASE /*!32312 IF NOT EXISTS*/`xaas_bot` /*!40100 DEFAULT CHARACTER SET utf8 */;

USE `xaas_bot`;

/*Table structure for table `configurations` */

DROP TABLE IF EXISTS `configurations`;

CREATE TABLE `configurations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `project` varchar(255) NOT NULL,
  `dataJSON` longtext,
  `templateJSON` longtext,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `project` (`project`),
  UNIQUE KEY `Configurations_project_unique` (`project`)
) ENGINE=MyISAM AUTO_INCREMENT=11 DEFAULT CHARSET=utf8;

/*Table structure for table `sessioninfo` */

DROP TABLE IF EXISTS `sessioninfo`;

CREATE TABLE `sessioninfo` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `sessionId` mediumtext,
  `sessionvalue` mediumtext,
  `createdAt` bigint(20) DEFAULT NULL,
  `updatedAt` bigint(20) DEFAULT NULL,
  `isDeleted` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
